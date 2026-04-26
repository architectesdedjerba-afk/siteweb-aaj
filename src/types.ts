/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Timestamp } from './lib/firebase';

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
  mustReset?: boolean;
  category?: MemberCategory | string;
  memberType?: string; // label from config/memberTypes
  memberTypeLetter?: string; // letter used in matricule AAJ
  birthDate?: string; // YYYY-MM-DD
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
  fileUrl?: string;
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

export type ChatChannelType = 'general' | 'custom';
export type ChatChannelStatus = 'pending' | 'approved' | 'rejected';

export interface ChatChannelLastMessage {
  text: string;
  senderId: string;
  senderName: string;
  createdAt: Timestamp | string;
  hasAttachment?: boolean;
}

export interface ChatChannel {
  id?: string;
  name: string;
  description?: string;
  type: ChatChannelType;
  status: ChatChannelStatus;
  isAllMembers: boolean;
  memberUids: string[];
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | string;
  approvedBy?: string;
  approvedAt?: Timestamp | string;
  rejectedReason?: string;
  iconColor?: string;
  lastMessage?: ChatChannelLastMessage;
  lastActivityAt?: Timestamp | string;
}

export interface ChatMessageReply {
  messageId: string;
  text: string;
  senderName: string;
}

export interface ChatMessage {
  id?: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  createdAt: Timestamp | string;
  editedAt?: Timestamp | string;
  replyTo?: ChatMessageReply;
  attachmentUrl?: string;
  attachmentId?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
  reactions?: Record<string, string[]>;
  deletedAt?: Timestamp | string;
}

export interface ChatChannelRead {
  channelId: string;
  lastReadAt: Timestamp | string;
}
