import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentVsLlmMapDiagram } from '../AgentVsLlmMapDiagram';

describe('AgentVsLlmMapDiagram', () => {
  it('renders both pod labels', () => {
    const { container } = render(<AgentVsLlmMapDiagram />);
    const labels = container.querySelectorAll('.onboarding-map-diagram__pod-label');
    expect(labels.length).toBe(2);
    expect(labels[0].textContent).toBe('AGENT');
    expect(labels[1].textContent).toBe('LLM');
  });

  it('shows both descriptions without interaction', () => {
    render(<AgentVsLlmMapDiagram />);
    expect(screen.getByText(/Orchestrates tools, manages memory/)).toBeInTheDocument();
    expect(screen.getByText(/Reasoning engine that generates text/)).toBeInTheDocument();
  });

  it('shows the API calls arrow label', () => {
    render(<AgentVsLlmMapDiagram />);
    expect(screen.getByText('API calls')).toBeInTheDocument();
  });

  it('shows the hint text', () => {
    render(<AgentVsLlmMapDiagram />);
    expect(screen.getByText(/Two separate processes/)).toBeInTheDocument();
  });

  it('renders pods as divs (not buttons)', () => {
    const { container } = render(<AgentVsLlmMapDiagram />);
    const pods = container.querySelectorAll('.onboarding-map-diagram__pod');
    pods.forEach((pod) => {
      expect(pod.tagName).toBe('DIV');
    });
  });
});
