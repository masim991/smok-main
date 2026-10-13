const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expo,
  { files: ['**/*.cjs'], languageOptions: { globals: { __dirname: 'readonly', require: 'readonly', module: 'readonly', process: 'readonly', console: 'readonly', Buffer: 'readonly' } } },
  { ignores: ['dist*/**','supabase/functions/**','components/app/**','components/components/**','components/contexts/AuthContext.tsx','components/contexts/SettingsContext.tsx','components/contexts/ThemeContext.tsx','components/contexts/NotificationContext.tsx'] },
  { files: ['**/*.ts','**/*.tsx'], rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
]);
