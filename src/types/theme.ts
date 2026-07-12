/**
 * 主题模式类型定义
 */
export type ThemeMode = 'light' | 'dark';

/**
 * 主题更改事件详情
 */
export interface ThemeChangedEventDetail {
    theme: ThemeMode;
}

/**
 * 主题更改自定义事件
 */
export interface ThemeChangedEvent extends CustomEvent<ThemeChangedEventDetail> {
    detail: ThemeChangedEventDetail;
}

export interface ThemeApplyOptions {
    persist?: boolean;
    notify?: boolean;
}

/**
 * 在首帧和 Astro 页面交换期间都可用的主题控制器。
 * `<html>` 上的主题属性是视觉状态源，控件只负责发起切换。
 */
export interface SolitudeThemeController {
    getTheme(): ThemeMode;
    applyTheme(theme: ThemeMode, options?: ThemeApplyOptions): ThemeMode;
    syncDocument(target: Document, theme?: ThemeMode): ThemeMode;
    syncControls(target?: Document | Element, theme?: ThemeMode): void;
    toggleTheme(): ThemeMode;
}

/**
 * 声明全局 Window 接口，添加主题事件类型
 */
declare global {
    interface Window {
        __solitudeTheme?: SolitudeThemeController;
        __solitudeThemeSwitchReady?: boolean;
    }

    interface WindowEventMap {
        themeChanged: ThemeChangedEvent;
    }
}
