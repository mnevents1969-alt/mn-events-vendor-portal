import { Routes, Route } from "react-router-dom";
import { ProtectedLayout } from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Home from "@/pages/Home";
import Events from "@/pages/Events";
import EventDetails from "@/pages/EventDetails";
import BookStall from "@/pages/BookStall";
import MyStall from "@/pages/MyStall";
import Redeem from "@/pages/Redeem";
import Payments from "@/pages/Payments";
import Profile from "@/pages/Profile";
import Help from "@/pages/Help";

import { AdminGuard } from "@/admin/AdminGuard";
import AdminDashboard from "@/admin/pages/Dashboard";
import AdminEvents from "@/admin/pages/Events";
import AdminEventForm from "@/admin/pages/EventForm";
import AdminVendors from "@/admin/pages/Vendors";
import AdminVendorDetail from "@/admin/pages/VendorDetail";
import AdminBookings from "@/admin/pages/Bookings";
import AdminBookingDetail from "@/admin/pages/BookingDetail";
import AdminPayments from "@/admin/pages/Payments";
import AdminAllocation from "@/admin/pages/Allocation";
import AdminDocuments from "@/admin/pages/Documents";
import AdminRedemptions from "@/admin/pages/Redemptions";
import AdminTickets from "@/admin/pages/Tickets";
import AdminTicketDetail from "@/admin/pages/TicketDetail";
import AdminAuditLog from "@/admin/pages/AuditLog";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/" element={<ProtectedLayout><Home /></ProtectedLayout>} />
      <Route path="/events" element={<ProtectedLayout><Events /></ProtectedLayout>} />
      <Route path="/events/:eventId" element={<ProtectedLayout><EventDetails /></ProtectedLayout>} />
      <Route path="/events/:eventId/book" element={<ProtectedLayout><BookStall /></ProtectedLayout>} />
      <Route path="/stall" element={<ProtectedLayout><MyStall /></ProtectedLayout>} />
      <Route path="/redeem" element={<ProtectedLayout><Redeem /></ProtectedLayout>} />
      <Route path="/payments" element={<ProtectedLayout><Payments /></ProtectedLayout>} />
      <Route path="/profile" element={<ProtectedLayout><Profile /></ProtectedLayout>} />
      <Route path="/help" element={<ProtectedLayout><Help /></ProtectedLayout>} />

      <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
      <Route path="/admin/events" element={<AdminGuard><AdminEvents /></AdminGuard>} />
      <Route path="/admin/events/new" element={<AdminGuard><AdminEventForm /></AdminGuard>} />
      <Route path="/admin/events/:eventId" element={<AdminGuard><AdminEventForm /></AdminGuard>} />
      <Route path="/admin/vendors" element={<AdminGuard><AdminVendors /></AdminGuard>} />
      <Route path="/admin/vendors/:vendorId" element={<AdminGuard><AdminVendorDetail /></AdminGuard>} />
      <Route path="/admin/bookings" element={<AdminGuard><AdminBookings /></AdminGuard>} />
      <Route path="/admin/bookings/:applicationId" element={<AdminGuard><AdminBookingDetail /></AdminGuard>} />
      <Route path="/admin/payments" element={<AdminGuard><AdminPayments /></AdminGuard>} />
      <Route path="/admin/allocation" element={<AdminGuard><AdminAllocation /></AdminGuard>} />
      <Route path="/admin/documents" element={<AdminGuard><AdminDocuments /></AdminGuard>} />
      <Route path="/admin/redemptions" element={<AdminGuard><AdminRedemptions /></AdminGuard>} />
      <Route path="/admin/tickets" element={<AdminGuard><AdminTickets /></AdminGuard>} />
      <Route path="/admin/tickets/:ticketId" element={<AdminGuard><AdminTicketDetail /></AdminGuard>} />
      <Route path="/admin/audit-log" element={<AdminGuard><AdminAuditLog /></AdminGuard>} />
    </Routes>
  );
}
