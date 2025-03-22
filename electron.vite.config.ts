import { resolve } from 'path'
import { loadEnv } from 'vite'
import type { UserConfig, ConfigEnv } from 'vite'
import { defineConfig, externalizeDepsPlugin, bytecodePlugin, defineViteConfig } from "electron-vite";
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import ServerUrlCopy from 'vite-plugin-url-copy'
import UnoCSS from "unocss/vite";
import { viteMockServe } from "vite-plugin-mock";
import progress from 'vite-plugin-progress'
import { createStyleImportPlugin, ElementPlusResolve } from 'vite-plugin-style-import'
import EslintPlugin from 'vite-plugin-eslint'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import { ViteEjsPlugin } from 'vite-plugin-ejs'
import PurgeIcons from 'vite-plugin-purge-icons'
import { visualizer } from 'rollup-plugin-visualizer'

const root = process.cwd()
function pathResolve(dir: string) {
  return resolve(root, '.', dir)
}

export default defineConfig( {
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    },
    plugins: [externalizeDepsPlugin(), bytecodePlugin()]
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    },
    plugins: [externalizeDepsPlugin(), bytecodePlugin()]
  },
  renderer: defineViteConfig(({command, mode}: ConfigEnv): UserConfig => {
    let env = {} as any
    // command是build或server
    const isBuild = command === 'build'
    if (!isBuild) {
      // 打包
      env = loadEnv(process.argv[3] === '--mode' ? process.argv[4] : process.argv[3], root)
    } else {
      // 启服务
      env = loadEnv(mode, root)
    }
    return {
      publicDir: pathResolve('resources'),
      // 环境变量的文件目录 .env文件
      envDir: pathResolve(""),
      // 环境变量前缀
      envPrefix: 'VITE_',
      base: env.VITE_BASE_PATH,
      plugins: [
        Vue({
          script: {
            // 开启defineModel
            defineModel: true
          }
        }),
        VueJsx(),
        ServerUrlCopy(),
        progress(),
        env.VITE_USE_ALL_ELEMENT_PLUS_STYLE === 'false'
          ? createStyleImportPlugin({
            resolves: [ElementPlusResolve()],
            libs: [
              {
                libraryName: 'element-plus',
                esModule: true,
                resolveStyle: (name) => {
                  if (name === 'click-outside') {
                    return ''
                  }
                  return `element-plus/es/components/${name.replace(/^el-/, '')}/style/css`
                }
              }
            ]
          })
          : undefined,
        EslintPlugin({
          cache: false,
          failOnWarning: false,
          failOnError: false,
          include: ['src/renderer/src/**/*.vue', 'src/renderer/src/**/*.ts', 'src/renderer/src/**/*.tsx'] // 检查的文件
        }),
        VueI18nPlugin({
          runtimeOnly: true,
          compositionOnly: true,
          include: [resolve(__dirname, 'src/renderer/src/locales/**')]
        }),
        // 处理svg
        createSvgIconsPlugin({
          iconDirs: [pathResolve('src/renderer/src/assets/svgs')],
          symbolId: 'icon-[dir]-[name]',
          svgoOptions: true // 启用svg优化
        }),
        PurgeIcons(),
        // mock
        env.VITE_USE_MOCK === 'true'
          ? viteMockServe({
            ignore: /^\_/,
            mockPath: 'src/renderer/mock', // mock代码的包路径
            localEnabled: !isBuild, // 在开发模式下启用
            prodEnabled: isBuild,
            injectCode: `
          import { setupProdMockServer } from '../src/renderer/mock/_createProductionServer'

          setupProdMockServer()
          `
          })
          : undefined,
        ViteEjsPlugin({
          title: env.VITE_APP_TITLE
        }),
        // 处理UnoCSS
        UnoCSS()
      ],
      // css
      css: {
        preprocessorOptions: {
          less: {
            additionalData: '@import "./src/renderer/src/styles/variables.module.less";',
            javascriptEnabled: true
          }
        }
      },
      resolve: {
        extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.less', '.css'],
        alias: [
          {
            find: 'vue-i18n',
            replacement: 'vue-i18n/dist/vue-i18n.cjs.js'
          },
          {
            find: /\@\//,
            replacement: `${pathResolve('src/renderer/src')}/`
          }
        ]
      },
      esbuild: {
        pure: env.VITE_DROP_CONSOLE === 'true' ? ['console.log'] : undefined,
        drop: env.VITE_DROP_DEBUGGER === 'true' ? ['debugger'] : undefined
      },
      build: {
        target: 'es2015',
        outDir: env.VITE_OUT_DIR || 'dist',
        sourcemap: env.VITE_SOURCEMAP === 'true',
        // brotliSize: false,
        rollupOptions: {
          plugins: env.VITE_USE_BUNDLE_ANALYZER === 'true' ? [visualizer()] : undefined,
          input: {
            index: pathResolve('src/renderer/index.html'),
          },
          // 拆包
          output: {
            manualChunks: {
              'vue-chunks': ['vue', 'vue-router', 'pinia', 'vue-i18n'],
              'element-plus': ['element-plus'],
              'wang-editor': ['@wangeditor/editor', '@wangeditor/editor-for-vue'],
              echarts: ['echarts', 'echarts-wordcloud']
            }
          }
        },
        cssCodeSplit: !(env.VITE_USE_CSS_SPLIT === 'false'),
        cssTarget: ['chrome31']
      },
      server: {
        port: 5713,
        proxy: {
          // 选项写法 前置url
          '/api': {
            target: 'http://127.0.0.1:8000',
            // 修改请求头中的Origin避免跨域问题
            changeOrigin: true,
            // 重写url去掉/api前缀
            rewrite: (path) => path.replace(/^\/api/, '')
          }
        },
        hmr: {
          overlay: false
        },
        host: '0.0.0.0'
      },
      optimizeDeps: {
        include: [
          'vue',
          'vue-router',
          'vue-types',
          'element-plus/es/locale/lang/zh-cn',
          'element-plus/es/locale/lang/en',
          '@iconify/iconify',
          '@vueuse/core',
          'axios',
          'qs',
          'echarts',
          'echarts-wordcloud',
          'qrcode',
          '@wangeditor/editor',
          '@wangeditor/editor-for-vue',
          'vue-json-pretty',
          '@zxcvbn-ts/core',
          'dayjs',
          'cropperjs'
        ]
      }
    }
  })
})
