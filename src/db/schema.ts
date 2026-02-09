import { pgTable, serial, text, integer, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(), // serial for auto-incrementing PK in PG
  name: varchar('name', { length: 256 }).notNull(),
  description: text('description'),
  capacity: integer('capacity').notNull(),
  imageUrl: text('image_url'), // Changed to text for Base64 storage
  openTime: varchar('open_time', { length: 5 }).notNull().default('09:00'), // HH:mm format
  closeTime: varchar('close_time', { length: 5 }).notNull().default('17:00'), // HH:mm format
});

export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  roomId: integer('room_id').references(() => rooms.id).notNull(),
  userId: varchar('user_id', { length: 256 }), // Clerk User ID (Optional)
  customerName: varchar('customer_name', { length: 256 }).notNull(),
  customerEmail: varchar('customer_email', { length: 256 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 20 }).notNull(),
  organization: varchar('organization', { length: 256 }),
  purpose: text('purpose').notNull(),
  needPccHelp: boolean('need_pcc_help').default(false).notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  status: varchar('status', { enum: ['pending', 'confirmed', 'cancelled'] }).default('pending'),
});

export const settings = pgTable('settings', {
  key: varchar('key', { length: 256 }).primaryKey(),
  value: text('value').notNull(), // JSON string or text for flexibility
});

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 256 }).notNull().unique(),
  password: varchar('password', { length: 256 }).notNull(), // Hashed password
  fullName: varchar('full_name', { length: 256 }),
  email: varchar('email', { length: 256 }),
  role: varchar('role', { enum: ['admin', 'staff', 'HTH'] }).notNull().default('admin'),
  status: varchar('status', { enum: ['pending', 'active', 'rejected'] }).default('pending').notNull(),
  officeHours: text('office_hours'), // JSON string for individual schedule
  bio: text('bio'), // "What you can ask me about"
});

export const appointmentRequests = pgTable('appointment_requests', {
  id: serial('id').primaryKey(),
  customerName: varchar('customer_name', { length: 256 }).notNull(),
  customerEmail: varchar('customer_email', { length: 256 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 20 }).notNull(),
  businessName: varchar('business_name', { length: 256 }), // New field
  preferredDate: varchar('preferred_date', { length: 50 }).notNull(),
  preferredTime: varchar('preferred_time', { length: 50 }).notNull(),
  reason: text('reason').notNull(),
  preferredStaffUsername: varchar('preferred_staff_username', { length: 256 }),
  status: varchar('status', { enum: ['pending', 'confirmed', 'rejected'] }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});