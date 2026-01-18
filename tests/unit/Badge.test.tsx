/**
 * Unit tests for Badge component
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge Component', () => {
  it('renders badge with text', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('applies default variant styling', () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('bg-primary');
  });

  it('applies secondary variant styling', () => {
    const { container } = render(<Badge variant="secondary">Secondary</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('bg-secondary');
  });

  it('applies outline variant styling', () => {
    const { container } = render(<Badge variant="outline">Outline</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('border-border');
  });

  it('accepts custom className', () => {
    const { container } = render(<Badge className="custom-badge">Custom</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('custom-badge');
  });

  it('renders with children components', () => {
    render(
      <Badge>
        <span>Icon</span>
        <span>Text</span>
      </Badge>
    );
    expect(screen.getByText('Icon')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('renders as a div element', () => {
    const { container } = render(<Badge>Test</Badge>);
    const badge = container.firstChild;
    expect(badge?.nodeName).toBe('DIV');
  });

  it('includes base styling classes', () => {
    const { container } = render(<Badge>Test</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('inline-flex', 'items-center', 'rounded-full');
  });
});
