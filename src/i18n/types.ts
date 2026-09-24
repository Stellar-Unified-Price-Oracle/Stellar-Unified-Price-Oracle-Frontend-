import type en from './locales/en'

/**
 * Type-safe i18n resources declaration.
 * The English locale serves as the authoritative type source.
 * All other locales should match this shape.
 */
export type I18nResources = typeof en

/**
 * Augment i18next's module with our resource types so that the `t()` function
 * is fully type-safe and IDE auto-complete works across the codebase.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: I18nResources
    }
  }
}
