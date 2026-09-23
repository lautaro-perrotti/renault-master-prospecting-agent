import tseslint from '@typescript-eslint/eslint-plugin'; import parser from '@typescript-eslint/parser';
export default [{ignores:['dist','coverage','node_modules']},{files:['**/*.ts'],languageOptions:{parser},plugins:{'@typescript-eslint':tseslint},rules:{'no-unused-vars':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}}];
