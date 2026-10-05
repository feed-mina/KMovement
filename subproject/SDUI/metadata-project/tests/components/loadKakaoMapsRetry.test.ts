describe('Kakao SDK retry', () => {
    beforeEach(() => {jest.resetModules(); delete window.kakao; document.getElementById('kakao-maps-sdk')?.remove();});
    it('초기화에 실패한 기존 스크립트를 제거하고 다음 요청에서 다시 생성한다', async () => {
        const old=document.createElement('script'); old.id='kakao-maps-sdk'; old.dataset.loaded='true'; document.head.append(old);
        const {loadKakaoMaps}=await import('@/components/fields/kride/maps/loadKakaoMaps');
        await expect(loadKakaoMaps('test')).rejects.toThrow('did not initialize');
        expect(old.isConnected).toBe(false);
        const retry=loadKakaoMaps('test');
        const script=document.getElementById('kakao-maps-sdk') as HTMLScriptElement;
        expect(script).not.toBeNull(); expect(script).not.toBe(old);
        const kakao={maps:{load:(callback:()=>void)=>callback()}}; window.kakao=kakao;
        script.dispatchEvent(new Event('load'));
        await expect(retry).resolves.toBe(kakao);
    });
});
