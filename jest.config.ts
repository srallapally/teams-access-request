import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts'],
};

export default config;
