import React from 'react';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';

interface NotificationCardProps {
  notification: any;
  isRead: boolean;
  onRead: (id: string) => void;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({ notification, isRead, onRead }) => {
  return (
    <Card 
      onClick={() => onRead(notification.id)}
      sx={{ 
        mb: 2, 
        cursor: 'pointer',
        backgroundColor: isRead ? '#ffffff' : '#f0f7ff',
        borderLeft: isRead ? '4px solid transparent' : '4px solid #1976d2',
        transition: '0.3s',
        '&:hover': {
          boxShadow: 3
        }
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: isRead ? 'normal' : 'bold' }}>
            {notification.type}
          </Typography>
          <Chip
            label={notification.type}
            color={notification.type === 'Placement' ? 'success' : notification.type === 'Result' ? 'primary' : 'default'}
            size="small"
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: isRead ? 'normal' : 'bold' }}>
          {notification.content}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 1 }} color="text.disabled">
          {new Date(notification.timestamp).toLocaleString()}
        </Typography>
      </CardContent>
    </Card>
  );
};
