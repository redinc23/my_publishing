import '@testing-library/jest-dom';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    const React = require('react');
    const { fill, priority, ...rest } = props;
    return React.createElement('img', { alt: props.alt || '', ...rest });
  },
}));
