/**
 * Real-Time Supabase Subscriptions Hook
 * 
 * This hook "attaches" your app to the Supabase database so changes
 * appear automatically without refreshing the page.
 * 
 * When another user (or you in another tab) adds/edits/deletes an event,
 * this hook detects the change and updates your UI immediately.
 * 
 * FIXED: Uses useRef pattern to prevent subscription churn from inline callbacks
 */

import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

/**
 * Subscribe to real-time changes for events table
 * 
 * @param {Function} onEventsChange - Callback when events data changes
 * @returns {Function} Cleanup function to unsubscribe
 */
export const useRealtimeEvents = (onEventsChange) => {
  // Use ref to store the latest callback without causing re-subscriptions
  const handlerRef = useRef(onEventsChange);

  // Update the ref when callback changes (doesn't trigger effect)
  useEffect(() => {
    handlerRef.current = onEventsChange;
  }, [onEventsChange]);

  // Set up subscription ONCE (empty dependency array)
  useEffect(() => {
    console.log('🔴 Setting up real-time subscription for events...');

    // Create a channel for events table
    const eventsChannel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'events'
        },
        (payload) => {
          console.log('🔴 Real-time event detected:', payload.eventType, payload.new || payload.old);
          
          // Call the latest callback via ref
          handlerRef.current?.(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error:', status);
        }
      });

    // Cleanup: Unsubscribe when component unmounts
    return () => {
      console.log('🔴 Cleaning up real-time subscription...');
      supabase.removeChannel(eventsChannel);
    };
  }, []); // Empty deps = subscribe once
};

/**
 * Subscribe to real-time changes for gym_links table
 * 
 * @param {Function} onGymLinksChange - Callback when gym_links data changes
 * @returns {Function} Cleanup function to unsubscribe
 */
export const useRealtimeGymLinks = (onGymLinksChange) => {
  const handlerRef = useRef(onGymLinksChange);

  useEffect(() => {
    handlerRef.current = onGymLinksChange;
  }, [onGymLinksChange]);

  useEffect(() => {
    console.log('🔴 Setting up real-time subscription for gym_links...');

    const gymLinksChannel = supabase
      .channel('gym-links-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gym_links'
        },
        (payload) => {
          console.log('🔴 Real-time gym_links change:', payload.eventType);
          handlerRef.current?.(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Gym links real-time subscription active!');
        }
      });

    return () => {
      supabase.removeChannel(gymLinksChannel);
    };
  }, []);
};

/**
 * Subscribe to real-time changes for gyms table
 * 
 * @param {Function} onGymsChange - Callback when gyms data changes
 * @returns {Function} Cleanup function to unsubscribe
 */
export const useRealtimeGyms = (onGymsChange) => {
  const handlerRef = useRef(onGymsChange);

  useEffect(() => {
    handlerRef.current = onGymsChange;
  }, [onGymsChange]);

  useEffect(() => {
    console.log('🔴 Setting up real-time subscription for gyms...');

    const gymsChannel = supabase
      .channel('gyms-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gyms'
        },
        (payload) => {
          console.log('🔴 Real-time gyms change:', payload.eventType);
          handlerRef.current?.(payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Gyms real-time subscription active!');
        }
      });

    return () => {
      supabase.removeChannel(gymsChannel);
    };
  }, []);
};
