"use client";

import React, { useEffect, useState } from 'react';

import {
  Home,
  Search,
  Bell,
  Bookmark,
  User,
  MoreHorizontal,
  Settings,
  LogOut,
  Clock,
  CreditCard,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import TwitterLogo from '../Twitterlogo';
import { useAuth } from '@/context/AuthContext';
import { Language, translate } from '@/lib/i18n';
import axiosInstance from '@/lib/axiosInstance';

interface SidebarProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
}

export default function Sidebar({ currentPage = 'home', onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const lang: Language = (user?.language as Language) || "en";
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!user?.email) {
      setUnreadNotifications(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const response = await axiosInstance.get('/notifications', { params: { email: user.email } });
        setUnreadNotifications((response.data || []).filter((notification: { read: boolean }) => !notification.read).length);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchUnreadCount();
    const interval = window.setInterval(fetchUnreadCount, 30000);
    const clearUnreadCount = () => setUnreadNotifications(0);
    window.addEventListener('notifications-read', clearUnreadCount);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('notifications-read', clearUnreadCount);
    };
  }, [user?.email]);

  const navigation = [
    { name: translate(lang, 'home'), icon: Home, current: currentPage === 'home', page: 'home' },
    { name: translate(lang, 'explore'), icon: Search, current: currentPage === 'explore', page: 'explore' },
    { name: translate(lang, 'subscribe'), icon: CreditCard, current: currentPage === 'subscription', page: 'subscription' },
    { name: translate(lang, 'notifications'), icon: Bell, current: currentPage === 'notifications', page: 'notifications', badge: true },
    { name: translate(lang, 'loginHistory'), icon: Clock, current: currentPage === 'loginHistory', page: 'loginHistory' },
    { name: translate(lang, 'bookmarks'), icon: Bookmark, current: currentPage === 'bookmarks', page: 'bookmarks' },
    { name: translate(lang, 'profile'), icon: User, current: currentPage === 'profile', page: 'profile' },
    { name: translate(lang, 'more'), icon: MoreHorizontal, current: currentPage === 'more', page: 'more' },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden border-r border-gray-800 bg-black">
      <div className="p-3 md:p-4">
        <TwitterLogo size="lg" className="text-white" />
      </div>
      
      <nav className="flex-1 overflow-y-auto px-2">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <Button
                variant="ghost"
                className={`w-full justify-center px-2 py-6 text-xl md:justify-start md:px-4 rounded-full ${
                  item.current ? 'bg-blue-500 font-bold' : 'font-normal hover:bg-gray-900'
                } text-white hover:text-white`}
                onClick={() => onNavigate?.(item.page)}
              >
                <item.icon className="h-7 w-7 md:mr-4" />
                <span className="hidden md:inline">{item.name}</span>
                {item.badge && unreadNotifications > 0 && (
                  <span className="absolute ml-8 -mt-5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs text-white md:static md:ml-2 md:mt-0">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </Button>
            </li>
          ))}
        </ul>
      </nav>
      
      {user && (
        <div className="border-t border-gray-800 p-2 md:p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-center rounded-full p-2 hover:bg-gray-900 md:justify-start md:p-3"
              >
                <Avatar className="h-10 w-10 md:mr-3">
                  <AvatarImage src={user.avatar} alt={user.displayName} />
                  <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                </Avatar>
                <div className="hidden flex-1 text-left md:block">
                  <div className="text-white font-semibold">{user.displayName}</div>
                  <div className="text-gray-400 text-sm">@{user.username}</div>
                </div>
                <MoreHorizontal className="hidden h-5 w-5 text-gray-400 md:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56 bg-black border-gray-800">
              <DropdownMenuItem className="text-white hover:bg-gray-900">
                <Settings className="mr-2 h-4 w-4" />
                {translate(lang, "settings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem 
                className="text-white hover:bg-gray-900"
                onClick={logout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {translate(lang, "logout")} @{user.username}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
