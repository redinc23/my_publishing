/**
 * Unit tests for Textarea component
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from '@/components/ui/textarea';

describe('Textarea Component', () => {
  it('renders textarea element', () => {
    render(<Textarea />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('accepts text input', async () => {
    const user = userEvent.setup();
    render(<Textarea />);
    
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello World');
    
    expect(textarea).toHaveValue('Hello World');
  });

  it('accepts multiline text', async () => {
    const user = userEvent.setup();
    render(<Textarea />);
    
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Line 1{Enter}Line 2{Enter}Line 3');
    
    expect(textarea).toHaveValue('Line 1\nLine 2\nLine 3');
  });

  it('shows placeholder text', () => {
    render(<Textarea placeholder="Enter your message" />);
    expect(screen.getByPlaceholderText('Enter your message')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(<Textarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('calls onChange handler', async () => {
    const handleChange = jest.fn();
    const user = userEvent.setup();
    
    render(<Textarea onChange={handleChange} />);
    await user.type(screen.getByRole('textbox'), 'a');
    
    expect(handleChange).toHaveBeenCalled();
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('accepts custom className', () => {
    render(<Textarea className="custom-textarea" />);
    expect(screen.getByRole('textbox')).toHaveClass('custom-textarea');
  });

  it('supports rows attribute', () => {
    render(<Textarea rows={5} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '5');
  });

  it('supports maxLength attribute', () => {
    render(<Textarea maxLength={100} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '100');
  });

  it('supports required attribute', () => {
    render(<Textarea required />);
    expect(screen.getByRole('textbox')).toBeRequired();
  });
});
