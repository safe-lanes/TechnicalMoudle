import React, { useState, useMemo, useEffect } from "react";
import { useModifyMode } from "@/hooks/useModifyMode";
import { useVessel } from "@/contexts/VesselContext";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useResolvedUserName } from "@/hooks/useResolvedUserName";
import { useChangeMode } from "@/contexts/ChangeModeContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Marker } from "@/components/Marker";
import { LocationSearchDropdown } from "@/components/LocationSearchDropdown";
import WOAgGridTable from "@/components/WOAgGridTable";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, Edit2, Clock, Trash2, FileSpreadsheet, X, MessageSquare, Calendar, PlusCircle, MinusCircle, Download, AlertCircle, CheckCircle, HelpCircle, MapPin, ChevronDown, ChevronsUpDown, Plus, Check, RotateCcw, Info, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, invalidateByUrlPrefix } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import { FEATURES } from "@/config/features";
import { useVessels } from "@/hooks/useVessels";
import { ModifyStickyFooter } from "@/components/modify/ModifyStickyFooter";
import { format } from "date-fns";
import { PeriodFilter, PeriodFilterValue, periodFilterToDateRange } from "@/components/filters/PeriodFilter";

// Helper function to get marker prefix based on active tab
const getMarkerPrefix = (tab: "stores" | "lubes" | "chemicals" | "others") => {
  switch (tab) {
    case "stores": return "F.S";
    case "lubes": return "F.L";
    case "chemicals": return "F.C";
    case "others": return "F.O";
