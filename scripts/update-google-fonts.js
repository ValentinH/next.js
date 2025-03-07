const fs = require('fs/promises')
const path = require('path')
const fetch = require('node-fetch')

;(async () => {
  const { familyMetadataList } = await fetch(
    'https://fonts.google.com/metadata/fonts'
  ).then((r) => r.json())

  let fontFunctions = `/**
  * This is an autogenerated file by scripts/update-google-fonts.js
  */
  import type { FontModule } from 'next/font'
  type Display = 'auto'|'block'|'swap'|'fallback'|'optional'
  type CssVariable = \`--\${string}\`
  `
  const fontData = {}
  for (let { family, fonts, axes, subsets } of familyMetadataList) {
    subsets = subsets.filter((subset) => subset !== 'menu')
    const weights = new Set()
    const styles = new Set()

    for (const variant of Object.keys(fonts)) {
      if (variant.endsWith('i')) {
        styles.add('italic')
        weights.add(variant.slice(0, -1))
        continue
      } else {
        styles.add('normal')
        weights.add(variant)
      }
    }

    const hasVariableFont = axes.length > 0

    let optionalAxes
    if (hasVariableFont) {
      weights.add('variable')

      const nonWeightAxes = axes.filter(({ tag }) => tag !== 'wght')
      if (nonWeightAxes.length > 0) {
        optionalAxes = nonWeightAxes
      }
    }

    fontData[family] = {
      weights: [...weights],
      styles: [...styles],
      axes: hasVariableFont ? axes : undefined,
    }
    const optionalIfVariableFont = hasVariableFont ? '?' : ''

    const formatUnion = (values) =>
      values.map((value) => `"${value}"`).join('|')

    const weightTypes = [...weights]
    const styleTypes = [...styles]

    fontFunctions += `export declare function ${family.replaceAll(
      ' ',
      '_'
    )}(options${optionalIfVariableFont}: {
    weight${optionalIfVariableFont}:${formatUnion(
      weightTypes
    )} | Array<${formatUnion(
      weightTypes.filter((weight) => weight !== 'variable')
    )}>
    style?: ${formatUnion(styleTypes)} | Array<${formatUnion(styleTypes)}>
    display?:Display
    variable?: CssVariable
    preload?:boolean
    fallback?: string[]
    adjustFontFallback?: boolean
    subsets?: Array<${formatUnion(subsets)}>
    ${
      optionalAxes
        ? `axes?:(${formatUnion(optionalAxes.map(({ tag }) => tag))})[]`
        : ''
    }
    }):FontModule
    `
  }

  await Promise.all([
    fs.writeFile(
      path.join(__dirname, '../packages/font/src/google/index.ts'),
      fontFunctions
    ),
    fs.writeFile(
      path.join(__dirname, '../packages/font/src/google/font-data.json'),
      JSON.stringify(fontData, null, 2)
    ),
  ])
})()
