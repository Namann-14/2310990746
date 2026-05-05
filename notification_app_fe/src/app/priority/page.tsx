"use client";
import React, { useState, useEffect } from 'react';
import { usePriorityNotifications } from '../../hooks/usePriorityNotifications';
import { NotificationCard } from '../../components/NotificationCard';
import { CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel, Box } from '@mui/material';
import { logInfo } from '@/lib/log';

export default function PriorityNotificationsPage() {
  const [limit, setLimit] = useState(10);
  const [type, setType] = useState('All');
  
  const { data, loading, error } = usePriorityNotifications();
  const [readState, setReadState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    logInfo('frontend', 'page', 'PriorityNotificationsPage mounted or updated');
  }, []);

  const handleRead = (id: string) => {
    setReadState((prev) => ({ ...prev, [id]: true }));
    logInfo('frontend', 'component', `Priority notification ${id} marked as read`);
  };

  const handleLimitChange = (e: any) => {
    setLimit(e.target.value);
    logInfo('frontend', 'page', `Priority limit changed to ${e.target.value}`);
  };

  const handleTypeChange = (e: any) => {
    setType(e.target.value);
    logInfo('frontend', 'page', `Priority filter changed to ${e.target.value}`);
  };

  let filteredData = data;
  if (type !== 'All') {
    filteredData = filteredData.filter((n: any) => n.type === type);
  }
  filteredData = filteredData.slice(0, limit);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <h2>Priority Notifications</h2>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select value={type} label="Type" onChange={handleTypeChange}>
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Placement">Placement</MenuItem>
              <MenuItem value="Result">Result</MenuItem>
              <MenuItem value="Event">Event</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Top N</InputLabel>
            <Select value={limit} label="Top N" onChange={handleLimitChange}>
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={15}>15</MenuItem>
              <MenuItem value={20}>20</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {filteredData.map((notification: any) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              isRead={!!readState[notification.id]}
              onRead={handleRead}
            />
          ))}
        </>
      )}
    </Box>
  );
}
