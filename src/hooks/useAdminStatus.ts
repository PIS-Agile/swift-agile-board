import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UserPermissions {
  user_id: string;
  is_admin: boolean;
  can_delete_items: boolean;
  can_manage_columns: boolean;
  can_manage_custom_fields: boolean;
  can_manage_projects: boolean;
  can_manage_users: boolean;
}

export function useAdminStatus() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_current_user_permissions');

        if (error) throw error;

        if (data && data.length > 0) {
          setPermissions(data[0]);
        } else {
          // Default non-admin permissions if function returns nothing
          setPermissions({
            user_id: user.id,
            is_admin: false,
            can_delete_items: false,
            can_manage_columns: false,
            can_manage_custom_fields: false,
            can_manage_projects: false,
            can_manage_users: false,
          });
        }
      } catch (error) {
        console.error('Error fetching admin status:', error);
        // Default to non-admin on error
        setPermissions({
          user_id: user.id,
          is_admin: false,
          can_delete_items: false,
          can_manage_columns: false,
          can_manage_custom_fields: false,
          can_manage_projects: false,
          can_manage_users: false,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user]);

  return {
    isAdmin: permissions?.is_admin || false,
    permissions,
    loading,
    canDeleteItems: permissions?.can_delete_items || false,
    canManageColumns: permissions?.can_manage_columns || false,
    canManageCustomFields: permissions?.can_manage_custom_fields || false,
    canManageProjects: permissions?.can_manage_projects || false,
    canManageUsers: permissions?.can_manage_users || false,
  };
}