import { render, route } from 'rwsdk/router';
import { defineApp } from 'rwsdk/worker';

import { Document } from '@/app/document';
import { setCommonHeaders } from '@/app/headers';
import { homeHandler } from '@/app/pages/home';
import { loginHandler } from '@/app/pages/login';
import { dashboardHandler, logoutHandler } from '@/app/pages/dashboard';
import { isAuthenticated } from '@/app/auth/interrupters';

export type AppContext = {
  username?: string;
};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route('/', homeHandler),
    route('/login', loginHandler),
    route('/dashboard', [isAuthenticated, dashboardHandler]),
    route('/logout', logoutHandler),
  ]),
]);
