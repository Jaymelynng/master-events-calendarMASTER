// We need to test the CacheManager class directly
// Import the singleton and use it, clearing between tests

// Mock localStorage and window for the module
const localStorageMock = {
  store: {},
  getItem: jest.fn((key) => localStorageMock.store[key] || null),
  setItem: jest.fn((key, value) => { localStorageMock.store[key] = value; }),
  removeItem: jest.fn((key) => { delete localStorageMock.store[key]; }),
  clear: jest.fn(() => { localStorageMock.store = {}; }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

// Must import after mocks are set up
const { cache } = require('../cache');

beforeEach(() => {
  cache.clearAll();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CacheManager', () => {
  test('set and get returns cached value', () => {
    cache.set('gyms', [{ id: 'CRR' }]);
    expect(cache.get('gyms')).toEqual([{ id: 'CRR' }]);
  });

  test('get returns null after TTL expires', () => {
    cache.set('gyms', [{ id: 'CRR' }], {}, 1000); // 1 second TTL
    jest.advanceTimersByTime(1001);
    expect(cache.get('gyms')).toBeNull();
  });

  test('get returns value before TTL expires', () => {
    cache.set('gyms', [{ id: 'CRR' }], {}, 5000);
    jest.advanceTimersByTime(4999);
    expect(cache.get('gyms')).toEqual([{ id: 'CRR' }]);
  });

  test('different params create different cache entries', () => {
    cache.set('events', 'jan-data', { month: 'jan' });
    cache.set('events', 'feb-data', { month: 'feb' });
    expect(cache.get('events', { month: 'jan' })).toBe('jan-data');
    expect(cache.get('events', { month: 'feb' })).toBe('feb-data');
  });

  test('clear removes a specific entry', () => {
    cache.set('gyms', 'data');
    cache.set('events', 'data');
    cache.clear('gyms');
    expect(cache.get('gyms')).toBeNull();
    expect(cache.get('events')).toBe('data');
  });

  test('invalidate is an alias for clear', () => {
    cache.set('gyms', 'data');
    cache.invalidate('gyms');
    expect(cache.get('gyms')).toBeNull();
  });

  test('clearAll removes everything', () => {
    cache.set('gyms', 'data1');
    cache.set('events', 'data2');
    cache.clearAll();
    expect(cache.get('gyms')).toBeNull();
    expect(cache.get('events')).toBeNull();
  });

  test('cleanUp only removes expired entries', () => {
    cache.set('short', 'expires', {}, 1000);
    cache.set('long', 'stays', {}, 10000);
    jest.advanceTimersByTime(2000);
    cache.cleanUp();
    expect(cache.get('short')).toBeNull();
    expect(cache.get('long')).toBe('stays');
  });

  test('getCacheKey generates unique keys', () => {
    const key1 = cache.getCacheKey('events', { month: 'jan' });
    const key2 = cache.getCacheKey('events', { month: 'feb' });
    const key3 = cache.getCacheKey('gyms', {});
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });
});
