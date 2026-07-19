import { getToken, isSupported } from 'firebase/messaging';
import { requestForToken } from '@/lib/firebase';

jest.mock('firebase/app', () => ({
    initializeApp: jest.fn(() => ({ name: 'test-app' })),
    getApps: jest.fn(() => []),
    getApp: jest.fn(() => ({ name: 'test-app' })),
}));

jest.mock('firebase/messaging', () => ({
    getMessaging: jest.fn(() => ({ name: 'test-messaging' })),
    getToken: jest.fn(),
    onMessage: jest.fn(),
    isSupported: jest.fn(),
}));

const mockedGetToken = getToken as jest.Mock;
const mockedIsSupported = isSupported as jest.Mock;
const mockRequestPermission = jest.fn();

const setNotificationPermission = (permission: NotificationPermission) => {
    Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: {
            permission,
            requestPermission: mockRequestPermission,
        },
    });
};

describe('requestForToken notification permission handling', () => {
    beforeEach(() => {
        mockedGetToken.mockReset();
        mockedIsSupported.mockReset().mockResolvedValue(true);
        mockRequestPermission.mockReset();
    });

    it('quietly skips Firebase when notifications are already denied', async () => {
        setNotificationPermission('denied');
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        await expect(requestForToken()).resolves.toBeNull();
        expect(mockRequestPermission).not.toHaveBeenCalled();
        expect(mockedGetToken).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it('does not call Firebase when the permission prompt is declined', async () => {
        setNotificationPermission('default');
        mockRequestPermission.mockResolvedValue('denied');

        await expect(requestForToken()).resolves.toBeNull();
        expect(mockedGetToken).not.toHaveBeenCalled();
    });

    it('retrieves a token only after permission is granted', async () => {
        setNotificationPermission('granted');
        mockedGetToken.mockResolvedValue('token-123');

        await expect(requestForToken()).resolves.toBe('token-123');
        expect(mockedGetToken).toHaveBeenCalledTimes(1);
    });

    it('treats a Firebase permission race as a quiet disabled state', async () => {
        setNotificationPermission('granted');
        mockedGetToken.mockRejectedValue({ code: 'messaging/permission-blocked' });
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        await expect(requestForToken()).resolves.toBeNull();
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
