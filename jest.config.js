/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/infrastructure/http/server.ts',
    '!src/infrastructure/http/container.ts',
    '!src/infrastructure/persistence/data-source.ts',
    '!src/infrastructure/persistence/RepositorioProfissionaisTypeOrm.ts',
    '!src/infrastructure/persistence/seed.ts',
    '!src/**/*.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['reflect-metadata']
};
