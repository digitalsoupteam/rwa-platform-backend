/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],
  moduleFileExtensions: ['ts', 'js'],
  rootDir: './',
  testMatch: [
    "**/tests/**/*.test.ts"
  ],
  verbose: true
};