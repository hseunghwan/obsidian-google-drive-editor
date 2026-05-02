import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('shows extension loading guidance when Chrome identity is unavailable', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Google Drive vault 연결' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Google Drive 연결은 Chrome 확장으로 로드한 뒤 사용할 수 있습니다.'
    );
  });
});
