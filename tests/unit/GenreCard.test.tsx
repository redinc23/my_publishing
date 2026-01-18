/**
 * Unit tests for GenreCard component
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { GenreCard } from '@/components/cards/GenreCard';

describe('GenreCard Component', () => {
  it('renders genre name', () => {
    render(<GenreCard genre="Fiction" />);
    expect(screen.getByText('Fiction')).toBeInTheDocument();
  });

  it('capitalizes genre name', () => {
    render(<GenreCard genre="science fiction" />);
    expect(screen.getByText('science fiction')).toHaveClass('capitalize');
  });

  it('renders book count when provided', () => {
    render(<GenreCard genre="Mystery" bookCount={42} />);
    expect(screen.getByText('42 books')).toBeInTheDocument();
  });

  it('does not render book count when not provided', () => {
    render(<GenreCard genre="Mystery" />);
    expect(screen.queryByText(/books/i)).not.toBeInTheDocument();
  });

  it('renders as a link to genre page', () => {
    render(<GenreCard genre="Fantasy" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/genres/fantasy');
  });

  it('applies custom className', () => {
    const { container } = render(<GenreCard genre="Romance" className="custom-class" />);
    const card = container.querySelector('.custom-class');
    expect(card).toBeInTheDocument();
  });

  it('has hover animation classes', () => {
    const { container } = render(<GenreCard genre="Thriller" />);
    const card = container.querySelector('.hover\\:scale-\\[1\\.02\\]');
    expect(card).toBeInTheDocument();
  });

  it('handles genre with zero books', () => {
    render(<GenreCard genre="Horror" bookCount={0} />);
    expect(screen.getByText('0 books')).toBeInTheDocument();
  });
});
