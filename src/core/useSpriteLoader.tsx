import { Texture, TextureLoader } from 'three'
import { useLoader, useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import * as React from 'react'
import * as THREE from 'three'

// utils
export const getFirstItem = (param: any): any => {
  if (Array.isArray(param)) {
    return param[0]
  } else if (typeof param === 'object' && param !== null) {
    const keys = Object.keys(param)

    return param[keys[0]][0]
  } else {
    return { w: 0, h: 0 }
  }
}

export const calculateAspectRatio = (width: number, height: number, factor: number, v: any): THREE.Vector3 => {
  const adaptedHeight = height * (v.aspect > width / height ? v.width / width : v.height / height)
  const adaptedWidth = width * (v.aspect > width / height ? v.width / width : v.height / height)
  const scaleX = adaptedWidth * factor
  const scaleY = adaptedHeight * factor
  const currentMaxScale = 1
  // Calculate the maximum scale based on the aspect ratio and max scale limit
  let finalMaxScaleW = Math.min(currentMaxScale, scaleX)
  let finalMaxScaleH = Math.min(currentMaxScale, scaleY)

  // Ensure that scaleX and scaleY do not exceed the max scale while maintaining aspect ratio
  if (scaleX > currentMaxScale) {
    finalMaxScaleW = currentMaxScale
    finalMaxScaleH = (scaleY / scaleX) * currentMaxScale
  }

  return new THREE.Vector3(finalMaxScaleW, finalMaxScaleH, 1)
}

export function useSpriteLoader<Url extends string>(
  input?: Url | null,
  json?: string | null,
  animationNames?: string[] | null,
  numberOfFrames?: number | null,
  onLoad?: (texture: Texture, textureData?: any) => void
): any {
  const v = useThree((state) => state.viewport)
  const gl = useThree((state) => state.gl)
  const spriteDataRef = React.useRef<any>(null)
  const totalFrames = React.useRef<number>(0)
  const aspectFactor = 0.1
  const [spriteData, setSpriteData] = useState<Record<string, any> | null>(null)
  const [spriteTexture, setSpriteTexture] = React.useState<THREE.Texture>(new THREE.Texture())
  const textureLoader = new THREE.TextureLoader()
  const [spriteObj, setSpriteObj] = useState<Record<string, any> | null>(null)

  React.useLayoutEffect(() => {
    if (json && input) {
      loadJsonAndTextureAndExecuteCallback(json, input, parseSpriteData)
    } else if (input) {
      // only load the texture, this is an image sprite only
      loadStandaloneSprite()
    }

    return () => {
      if (input) {
        useLoader.clear(TextureLoader, input)
      }
    }
  }, [])

  function loadJsonAndTexture(textureUrl: string, jsonUrl?: string) {
    if (jsonUrl && textureUrl) {
      loadJsonAndTextureAndExecuteCallback(jsonUrl, textureUrl, parseSpriteData)
    } else {
      loadStandaloneSprite(textureUrl)
    }
  }

  function loadStandaloneSprite(textureUrl?: string) {
    if (textureUrl || input) {
      new Promise<THREE.Texture>((resolve) => {
        textureLoader.load(textureUrl ?? input!, resolve)
      }).then((texture) => {
        parseSpriteData(null, texture)
      })
    }
  }

  /**
   *
   */
  function loadJsonAndTextureAndExecuteCallback(
    jsonUrl: string,
    textureUrl: string,
    callback: (json: any, texture: THREE.Texture) => void
  ): void {
    const jsonPromise = fetch(jsonUrl).then((response) => response.json())
    const texturePromise = new Promise<THREE.Texture>((resolve) => {
      textureLoader.load(textureUrl, resolve)
    })

    Promise.all([jsonPromise, texturePromise]).then((response) => {
      callback(response[0], response[1])
    })
  }

  const parseSpriteData = (json: any, _spriteTexture: THREE.Texture): void => {
    let aspect = new THREE.Vector3(1, 1, 1)
    // sprite only case
    if (json === null) {
      if (_spriteTexture && numberOfFrames) {
        //get size from texture
        const width = _spriteTexture.image.width
        const height = _spriteTexture.image.height
        const frameWidth = width / numberOfFrames
        const frameHeight = height
        totalFrames.current = numberOfFrames
        spriteDataRef.current = {
          frames: [],
          meta: {
            version: '1.0',
            size: { w: width, h: height },
            scale: '1',
          },
        }

        if (parseInt(frameWidth.toString(), 10) === frameWidth) {
          // if it fits
          for (let i = 0; i < numberOfFrames; i++) {
            spriteDataRef.current.frames.push({
              frame: { x: i * frameWidth, y: 0, w: frameWidth, h: frameHeight },
              rotated: false,
              trimmed: false,
              spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
              sourceSize: { w: frameWidth, h: height },
            })
          }
        }

        aspect = calculateAspectRatio(frameWidth, frameHeight, aspectFactor, v)
      }
    } else if (_spriteTexture) {
      spriteDataRef.current = json
      spriteDataRef.current.frames = Array.isArray(json.frames) ? json.frames : parseFrames()
      totalFrames.current = Array.isArray(json.frames) ? json.frames.length : Object.keys(json.frames).length
      const { w, h } = getFirstItem(json.frames).sourceSize
      aspect = calculateAspectRatio(w, h, aspectFactor, v)
    }

    setSpriteData(spriteDataRef.current)
    _spriteTexture.encoding = THREE.sRGBEncoding
    setSpriteTexture(_spriteTexture)
    setSpriteObj({ spriteTexture: _spriteTexture, spriteData: spriteDataRef.current, aspect: aspect })
  }

  // for frame based JSON Hash sprite data
  const parseFrames = (): any => {
    const sprites: any = {}
    const data = spriteDataRef.current
    const delimiters = animationNames
    if (delimiters) {
      for (let i = 0; i < delimiters.length; i++) {
        // we convert each named animation group into an array
        sprites[delimiters[i]] = []

        for (const innerKey in data['frames']) {
          const value = data['frames'][innerKey]
          const frameData = value['frame']
          const x = frameData['x']
          const y = frameData['y']
          const width = frameData['w']
          const height = frameData['h']
          const sourceWidth = value['sourceSize']['w']
          const sourceHeight = value['sourceSize']['h']

          if (typeof innerKey === 'string' && innerKey.toLowerCase().indexOf(delimiters[i].toLowerCase()) !== -1) {
            sprites[delimiters[i]].push({
              x: x,
              y: y,
              w: width,
              h: height,
              frame: frameData,
              sourceSize: { w: sourceWidth, h: sourceHeight },
            })
          }
        }
      }
      return sprites
    } else {
      // we need to convert it into an array
      const spritesArr: any[] = []
      for (const key in data.frames) {
        spritesArr.push(data.frames[key])
      }

      return spritesArr
    }
  }

  React.useLayoutEffect(() => {
    onLoad?.(spriteTexture, spriteData)
  }, [spriteTexture, spriteData])

  // https://github.com/mrdoob/three.js/issues/22696
  // Upload the texture to the GPU immediately instead of waiting for the first render
  // NOTE: only available for WebGLRenderer
  useEffect(() => {
    if ('initTexture' in gl) {
      const array = Array.isArray(spriteTexture) ? spriteTexture : [spriteTexture]
      array.forEach(gl.initTexture)
    }
  }, [gl, spriteTexture])

  return { spriteObj, loadJsonAndTexture }
}

useSpriteLoader.preload = (url: string) => useLoader.preload(TextureLoader, url)
useSpriteLoader.clear = (input: string) => useLoader.clear(TextureLoader, input)
