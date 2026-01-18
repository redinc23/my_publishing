/**
 * Unit tests for SearchBar component
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '@/components/shared/SearchBar';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('SearchBar Component', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders search input', () => {
    render(<SearchBar />);
    expect(screen.getByPlaceholderText('Search books...')).toBeInTheDocument();
  });

  it('updates input value when typing', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    
    const input = screen.getByPlaceholderText('Search books...') as HTMLInputElement;
    await user.type(input, 'fiction');
    
    expect(input.value).toBe('fiction');
  });

  it('navigates to search results on submit', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    
    const input = screen.getByPlaceholderText('Search books...');
    await user.type(input, 'mystery');
    await user.type(input, '{Enter}');
    
    expect(mockPush).toHaveBeenCalledWith('/books?q=mystery');
  });

  it('trims whitespace before searching', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    
    const input = screen.getByPlaceholderText('Search books...');
    await user.type(input, '  thriller  ');
    await user.type(input, '{Enter}');
    
    expect(mockPush).toHaveBeenCalledWith('/books?q=thriller');
  });

  it('does not navigate with empty query', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    
    const input = screen.getByPlaceholderText('Search books...');
    await user.type(input, '{Enter}');
    
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not navigate with whitespace-only query', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    
    const input = screen.getByPlaceholderText('Search books...');
    await user.type(input, '   ');
    await user.type(input, '{Enter}');
    
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('encodes special characters in query', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    
    const input = screen.getByPlaceholderText('Search books...');
    await user.type(input, 'sci-fi & fantasy');
    await user.type(input, '{Enter}');
    
    expect(mockPush).toHaveBeenCalledWith('/books?q=sci-fi%20%26%20fantasy');
  });

  it('has correct input type', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Search books...');
    expect(input).toHaveAttribute('type', 'search');
  });
});
