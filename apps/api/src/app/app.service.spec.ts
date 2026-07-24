import { describe, expect, it } from 'vitest';
import { AppService } from './app.service';

describe('AppService', () => {
  it('returns the welcome message', () => {
    expect(new AppService().getData()).toEqual({ message: 'Hello API' });
  });
});
