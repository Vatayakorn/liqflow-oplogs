/**
 * Referral API Service
 * Manages the list of referral customers
 */

import { supabase } from '$lib/supabaseClient';

export interface ReferralCustomer {
    customer_name: string;
    created_at: string;
}

/**
 * Get all referral customers
 */
export async function getReferralCustomers(): Promise<string[]> {
    try {
        const { data, error } = await supabase
            .from('referral_customers')
            .select('customer_name');

        if (error) {
            console.error('[Referral API] Error fetching:', error);
            return [];
        }

        return (data || []).map(r => r.customer_name);
    } catch (error) {
        console.error('[Referral API] Failed to fetch:', error);
        return [];
    }
}

/**
 * Add a customer to referral list
 */
export async function addReferralCustomer(name: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('referral_customers')
            .upsert({ customer_name: name });

        if (error) {
            console.error('[Referral API] Error adding:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[Referral API] Failed to add:', error);
        return false;
    }
}

/**
 * Remove a customer from referral list
 */
export async function removeReferralCustomer(name: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('referral_customers')
            .delete()
            .eq('customer_name', name);

        if (error) {
            console.error('[Referral API] Error removing:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[Referral API] Failed to remove:', error);
        return false;
    }
}
