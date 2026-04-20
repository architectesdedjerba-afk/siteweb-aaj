/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'super-admin' | 'admin' | 'member' | 'representative' | string;
export type UserStatus = 'pending' | 'active' | 'suspended';
export type MemberCategory = 'Architecte' | 'Architecte Stagiaire';

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Record<string, boolean>;
  isSystem: boolean;
  isAllAccess?: boolean;
  createdAt?: Timestamp | string;
}

export interface Cotisation {
  paid: boolean;
  paidAt?: Timestamp | string;
  amount?: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  category?: MemberCategory;
  licenseNumber?: string;
  mobile?: string;
  address?: string;
  photoBase64?: string;
  createdAt?: Timestamp | string;
  cotisations?: Record<string, Cotisation>;
}

export type EventType = 'Past' | 'Future';

export interface EventItem {
  id?: string;
  title: string;
  date: string;
  type: EventType;
  desc: string;
  image?: string;
}

export type PartnerTier = 'Platine' | 'Or' | 'Argent';

export interface Partner {
  id?: string;
  name: string;
  logoUrl?: string;
  category?: PartnerTier;
  level?: PartnerTier;
  joined?: string;
  isVisible?: boolean;
  website?: string;
  createdAt?: Timestamp;
}

export interface PartnerCategory {
  name: PartnerTier;
  price: string;
  benefits: string[];
}

export interface NewsItem {
  id?: string;
  title: string;
  content: string;
  date: string;
  type: EventType;
  category?: string;
  imageUrl?: string;
  fileBase64?: string;
  fileName?: string;
  createdAt?: Timestamp;
}

export interface LibraryDocument {
  id?: string;
  name: string;
  url?: string;
  fileBase64?: string;
  category: string;
  subCategory?: string;
  fileType: string;
  createdAt: Timestamp | string;
}

export interface CommissionPV {
  id?: string;
  town: string;
  date: string;
  count: number;
  fileBase64?: string;
  fileName?: string;
  createdAt?: Timestamp;
}

export interface ContactMessage {
  id?: string;
  userId: string;
  userEmail?: string;
  subject: string;
  message: string;
  fileBase64?: string;
  fileName?: string;
  createdAt: Timestamp | string;
}

export interface ProfileUpdateRequest {
  id?: string;
  uid: string;
  userEmail: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  category?: MemberCategory;
  licenseNumber?: string;
  address?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp | string;
}

export interface EventRegistration {
  id?: string;
  fullName: string;
  email: string;
  eventTitle: string;
  message?: string;
  createdAt: Timestamp | string;
}

export interface MembershipApplication {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  category: MemberCategory;
  matricule: string;
  city: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp | string;
}

export interface PartnerApplication {
  id?: string;
  contactName: string;
  email: string;
  phone: string;
  companyName: string;
  activity: string;
  sponsorshipType: 'platine' | 'or' | 'argent' | 'autre';
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp | string;
}
