import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import UnoCSS from "unocss/vite";
import { viteMockServe } from "vite-plugin-mock";

// 开发模式
const isDev = process.env.NODE_ENV !== 'production'

export default defineConfig( {
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [
      vue(),
      // 处理svg
      createSvgIconsPlugin({
        // 指定SVG图标存放目录
        iconDirs: [resolve(__dirname, 'src/renderer/src/assets/svgs')],
        symbolId: 'icon-[dir]-[name]',
        svgoOptions: true // 启用SVG优化
      }),
      // 处理UnoCSS
      UnoCSS(),
      // mock
      viteMockServe({
        mockPath: 'src/renderer/mock', // Mock数据存放的目录
        localEnabled: isDev, // 仅在开发模式启用
        prodEnabled: !isDev, // 生产环境是否启用
        injectCode: `
            import { setupProdMockServer } from '../src/renderer/mock/_createProductionServer'
            setupProdMockServer()
          `,
      })
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
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: isDev ? 'http://127.0.0.1:8000' : 'https://api.prod.com',
          changeOrigin: true, // 修改请求头中的Origin 避免跨域问题
          rewrite: (path) => path.replace(/^\/api/, '') // 重写URL去掉/api前缀
        }
      },
      hmr: {
        overlay: false
      },
      host: '0.0.0.0'
    }
  },
})
