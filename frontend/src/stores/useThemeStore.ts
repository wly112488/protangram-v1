import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

/**
 * 主题管理Store
 * @description 管理应用主题状态，支持亮色/深色主题切换
 */
const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      
      /**
       * 切换主题
       */
      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        set({ theme: newTheme });
        
        // 更新document的data-theme属性
        document.documentElement.setAttribute('data-theme', newTheme);
      },
      
      /**
       * 设置指定主题
       * @param theme - 主题模式
       */
      setTheme: (theme: ThemeMode) => {
        set({ theme });
        document.documentElement.setAttribute('data-theme', theme);
      },
    }),
    {
      name: 'tangram-theme-storage',
      onRehydrateStorage: () => (state) => {
        // 恢复主题时同步到document
        if (state?.theme) {
          document.documentElement.setAttribute('data-theme', state.theme);
        }
      },
    }
  )
);

export default useThemeStore;
