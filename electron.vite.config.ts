import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import UnoCSS from "unocss/vite";

export default defineConfig({
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
    ],
    // css
    css: {
      preprocessorOptions: {
        less: {
          additionalData: '@import "./src/renderer/src/styles/variables.module.less";',
          javascriptEnabled: true
        }
      }
    }
  },
})
