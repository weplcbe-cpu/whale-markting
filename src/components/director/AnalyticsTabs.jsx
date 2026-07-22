import React from 'react';
import { Award, MapPin, Package } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui';

const tabs = [
  { label: 'Product Overview', path: '/director/analytics/products', icon: Package },
  { label: 'Area Overview', path: '/director/analytics/areas', icon: MapPin },
  { label: 'Performance', path: '/director/analytics/performance', icon: Award }
];

export const AnalyticsTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return <nav className="director-analytics-tabs" aria-label="Director analytics">{tabs.map(({ label, path, icon: Icon }) => <Button key={path} variant={location.pathname === path ? 'primary' : 'secondary'} onClick={() => navigate(path)}><Icon size={16} /> {label}</Button>)}</nav>;
};

export default AnalyticsTabs;
