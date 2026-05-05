"use client";
import React, { useState, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationCard } from '../components/NotificationCard';
import { Pagination, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel, Box } from '@mui/material';
import { logInfo } from '@/lib/log';

export default function AllNotificationsPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('All');
  const limit = 10;
  
  const { data, total, loading, error } = useNotifications(page, limit, type);
  const [readState, setReadState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    logInfo('frontend', 'page', 'AllNotificationsPage mounted or updated');
  }, []);

  const handleRead = (id: string) => {
    setReadState((prev) => ({ ...prev, [id]: true }));
    logInfo('frontend', 'component', `Notification ${id} marked as read`);
  };

  const handleTypeChange = (e: any) => {
    setType(e.target.value);
    setPage(1);
    logInfo('frontend', 'page', `Filter changed to ${e.target.value}`);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <h2>All Notifications</h2>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Type</InputLabel>
          <Select value={type} label="Type" onChange={handleTypeChange}>
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="Placement">Placement</MenuItem>
            <MenuItem value="Result">Result</MenuItem>
            <MenuItem value="Event">Event</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {data.map((notification: any) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              isRead={!!readState[notification.id]}
              onRead={handleRead}
            />
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 4 }}>
            <Pagination 
              count={Math.ceil(total / limit) || 1} 
              page={page} 
              onChange={(_, p) => setPage(p)} 
              color="primary" 
            />
          </Box>
        </>
      )}
    </Box>
  );
}
