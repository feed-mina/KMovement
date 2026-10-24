import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import MapViewInner from '@/components/fields/kride/MapViewInner';

let mockReducedMotion = false;
const mockMap = {stop: jest.fn(), flyTo: jest.fn(), setView: jest.fn()};
jest.mock('@/components/motion/KrideMotion', () => ({useKrideReducedMotion: () => mockReducedMotion}));
jest.mock('react-leaflet', () => {
  const React = require('react');
  return {
    MapContainer: ({children}: any) => <div>{children}</div>,
    TileLayer: () => null,
    Polyline: () => null,
    Popup: ({children}: any) => <span>{children}</span>,
    useMap: () => mockMap,
    Marker: React.forwardRef(function TestMarker({children, icon, alt, eventHandlers}: any, ref: any) {
      const element = React.useRef(null);
      React.useImperativeHandle(ref, () => ({getElement: () => element.current, setZIndexOffset: jest.fn()}));
      return <div ref={element} data-testid="leaflet-marker" style={{transform: 'translate3d(100px, 100px, 0px)'}}>
        <button aria-label={alt} onClick={eventHandlers.click} dangerouslySetInnerHTML={{__html: icon.options.html}} />
        {children}
      </div>;
    }),
  };
});
const marker = {id: 'p1', name: '경복궁', index: 0, lat: 37.58, lng: 126.97};
beforeEach(() => {mockReducedMotion = false; Object.values(mockMap).forEach((fn) => fn.mockClear());});

it('selects a pin and scales only its inner dot, preserving SDK positioning', () => {
  const onSelect = jest.fn();
  const {rerender} = render(<MapViewInner markers={[marker]} onMarkerSelect={onSelect} />);
  fireEvent.click(screen.getByRole('button', {name: '1. 경복궁'}));
  expect(onSelect).toHaveBeenCalledWith(marker);
  rerender(<MapViewInner markers={[marker]} onMarkerSelect={onSelect} selectedMarkerId="p1" />);
  const element = screen.getByTestId('leaflet-marker');
  expect(element.style.transform).toBe('translate3d(100px, 100px, 0px)');
  expect(element.querySelector('.route-pin__dot')).toHaveAttribute('data-selected', 'true');
  expect(mockMap.flyTo).toHaveBeenLastCalledWith([37.58, 126.97], 15, {animate: true, duration: 0.5});
});

it('stops camera animation and jumps directly when reduced motion is enabled', () => {
  const markers = [marker];
  const {rerender, unmount} = render(<MapViewInner markers={markers} selectedMarkerId="p1" />);
  mockReducedMotion = true;
  rerender(<MapViewInner markers={markers} selectedMarkerId="p1" />);
  expect(mockMap.stop).toHaveBeenCalled();
  expect(mockMap.setView).toHaveBeenLastCalledWith([37.58, 126.97], 15, {animate: false});
  unmount();
  expect(mockMap.stop).toHaveBeenCalled();
});
