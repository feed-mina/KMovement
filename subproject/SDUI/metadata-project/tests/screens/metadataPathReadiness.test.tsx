import {act,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MetadataProvider,useMetadata} from '@/components/providers/MetadataProvider';
import {registerScreenPaths,getScreenPathsVersion} from '@/components/constants/screenMap';
jest.mock('next/navigation',()=>({usePathname:()=>'/view/LATE_TRAVEL',useParams:()=>({slug:['LATE_TRAVEL']})}));
jest.mock('@/context/AuthContext',()=>({useAuth:()=>({user:null})}));
function ReadScreen(){return <div>{useMetadata().screenId}</div>}
test('late route registration replaces the stale raw ID without navigating or reloading',async()=>{
 const original=global.fetch;global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({data:[]})});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 try{
  render(<QueryClientProvider client={client}><MetadataProvider><ReadScreen/></MetadataProvider></QueryClientProvider>);
  await screen.findByText('LATE_TRAVEL');
  act(()=>registerScreenPaths({'/LATE_TRAVEL':'KRIDE_FOCUS'}));
  await screen.findByText('KRIDE_FOCUS');
  await waitFor(()=>expect(fetch).toHaveBeenCalledWith('/api/ui/KRIDE_FOCUS'));
  const version=getScreenPathsVersion();act(()=>registerScreenPaths({'/LATE_TRAVEL':'KRIDE_FOCUS'}));
  expect(getScreenPathsVersion()).toBe(version);
 }finally{global.fetch=original;client.clear()}
});
