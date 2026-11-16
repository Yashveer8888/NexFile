import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

// Mock SafeAreaProvider and Navigation for isolated unit testing
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaConsumer: ({ children }: any) => children(inset),
    useSafeAreaInsets: () => inset,
  };
});

jest.mock('../src/app/navigation/RootNavigator', () => {
  const { View, Text } = require('react-native');
  return {
    RootNavigator: () => (
      <View testID="root-navigator">
        <Text>NexFile Navigation</Text>
      </View>
    ),
  };
});

import App from '../App';

describe('App Root Component', () => {
  test('renders NexFile application correctly without crashing', async () => {
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<App />);
    });
    expect(tree).toBeDefined();
    expect(tree.toJSON()).toBeTruthy();
  });
});
