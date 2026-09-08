const nodeTransform = {
  '^.+\\.[jt]sx?$': require.resolve('babel-jest'),
};

module.exports = {
  projects: [
    {
      displayName: 'logic',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/**/*.logic.test.ts'],
      transform: nodeTransform,
    },
    {
      displayName: 'database',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/**/*.database.test.ts'],
      transform: nodeTransform,
    },
    {
      ...require('jest-expo/jest-preset'),
      displayName: 'component',
      testMatch: ['<rootDir>/tests/**/*.component.test.tsx'],
      setupFilesAfterEnv: [
        ...(require('jest-expo/jest-preset').setupFilesAfterEnv ?? []),
        '<rootDir>/jest.setup.ts',
      ],
      moduleNameMapper: {
        '\\.css$': '<rootDir>/tests/support/style-mock.js',
      },
    },
  ],
};
