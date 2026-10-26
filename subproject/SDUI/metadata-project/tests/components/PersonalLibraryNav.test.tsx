import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonalLibraryNav from '@/components/personal/PersonalLibraryNav';
test('keeps the saved category/page when going to videos and marks only the current destination',async()=>{
    const {container}=render(<PersonalLibraryNav active="saved" savedHref="/view/KPOP_SAVED_ITEMS?kind=events&page=2" videoEnabled/>);
    expect(screen.getByRole('link',{name:'내 목록'})).toHaveAttribute('aria-current','page');
    expect(container.querySelectorAll('[aria-current=page]')).toHaveLength(1);
    const href=screen.getByRole('link',{name:'내 영상'}).getAttribute('href')!;
    expect(new URL(href,'https://test').searchParams.get('returnTo')).toBe('/view/KPOP_SAVED_ITEMS?kind=events&page=2');
    const user=userEvent.setup();await user.tab();expect(screen.getByRole('link',{name:'마이페이지'})).toHaveFocus();await user.tab();expect(screen.getByRole('link',{name:'내 목록'})).toHaveFocus();await user.tab();expect(screen.getByRole('link',{name:'내 영상'})).toHaveFocus();
});
test('hides the video entry when disabled but leaves other private destinations accessible',()=>{
    render(<PersonalLibraryNav active="profile" videoEnabled={false}/>);
    expect(screen.queryByRole('link',{name:'내 영상'})).toBeNull();expect(screen.getByRole('link',{name:'내 목록'})).toBeInTheDocument();
});
