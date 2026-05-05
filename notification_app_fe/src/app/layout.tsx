"use client";
import './globals.css';
import { AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material';
import Link from 'next/link';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Campus Notifications
            </Typography>
            <Box>
              <Button color="inherit" component={Link} href="/">
                All
              </Button>
              <Button color="inherit" component={Link} href="/priority">
                Priority
              </Button>
            </Box>
          </Toolbar>
        </AppBar>
        <Container maxWidth="md" sx={{ mt: 4 }}>
          {children}
        </Container>
      </body>
    </html>
  );
}
