import { describe, it, expect } from 'vitest';
import { pingDomain } from './pingService';

const url = "skylergodfrey.com"

describe('pingDomain', () => {
  it('should successfully ping ' + url, async () => {
    const status = await pingDomain(url);
    expect(status).toBe(200);
  });

  it('should successfully ping www.' + url, async () => {
    const status = await pingDomain(url);
    expect(status).toBe(200);
  });
});