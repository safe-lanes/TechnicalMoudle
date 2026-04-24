import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, X, Calendar } from "lucide-react";

interface StoresChangeRequestFormProps {
  onClose: () => void;
  onSubmit?: (storesData: any) => void;
  initialData?: any;
  category?: "stores" | "lubes" | "chemicals" | "others";
}

interface StoreItem {
  itemCode: string;
  itemName: string;
  storesCategory: string;
  rob: string;
  consumed: string;
  received: string;
  newRob: string;
  comments: string;
}

const StoresChangeRequestForm: React.FC<StoresChangeRequestFormProps> = ({
  onClose,
  onSubmit,
  initialData = {},
  category = "stores"
}) => {
  const [placeReceived, setPlaceReceived] = useState(initialData.placeReceived || "");
  const [dateReceived, setDateReceived] = useState(initialData.dateReceived || "");
  
  const [storeItems, setStoreItems] = useState<StoreItem[]>([
    {
      itemCode: initialData.itemCode || "",
      itemName: initialData.itemName || "",
      storesCategory: initialData.storesCategory || "",
      rob: initialData.rob || "0",
      consumed: "",
      received: "",
      newRob: initialData.rob || "0",
      comments: ""
    },
    { itemCode: "", itemName: "", storesCategory: "", rob: "", consumed: "", received: "", newRob: "", comments: "" },
    { itemCode: "", itemName: "", storesCategory: "", rob: "", consumed: "", received: "", newRob: "", comments: "" }
  ]);

  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());

  const [commentDialog, setCommentDialog] = useState<{
    open: boolean;
    index: number | null;
    itemName: string;
  }>({ open: false, index: null, itemName: "" });
  const [commentDraft, setCommentDraft] = useState("");

  const openCommentDialog = (index: number, itemName: string) => {
    setCommentDraft(storeItems[index]?.comments || "");
    setCommentDialog({ open: true, index, itemName });
  };

  const closeCommentDialog = () => {
    setCommentDialog({ open: false, index: null, itemName: "" });
    setCommentDraft("");
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'placeReceived') {
      setPlaceReceived(value);
    } else if (field === 'dateReceived') {
      setDateReceived(value);
    }

    // Track changed fields for red highlighting
    const initialValue = initialData[field];
    
    if (value !== initialValue) {
      setChangedFields(prev => new Set([...Array.from(prev), field]));
    } else {
      setChangedFields(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(field);
        return newSet;
      });
    }
  };

  const handleItemChange = (index: number, field: keyof StoreItem, value: string) => {
    setStoreItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Calculate new ROB
      if (field === 'consumed' || field === 'received' || field === 'rob') {
        const consumed = parseFloat(newItems[index].consumed) || 0;
        const received = parseFloat(newItems[index].received) || 0;
        const originalRob = parseFloat(newItems[index].rob) || 0;
        newItems[index].newRob = (originalRob - consumed + received).toString();
      }
      
      return newItems;
    });

    // Track changed fields for red highlighting
    const fieldKey = `${index}.${field}`;
    const initialValue = initialData[field];
    
    if (value !== initialValue) {
      setChangedFields(prev => new Set([...Array.from(prev), fieldKey]));
    } else {
      setChangedFields(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(fieldKey);
        return newSet;
      });
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({ placeReceived, dateReceived, storeItems });
      onClose();
    }
  };

  const getInputStyle = (field: string) => {
    const isChanged = changedFields.has(field);
    return `text-sm ${isChanged ? 'text-red-500 border-red-500' : 'text-[#52baf3] border-[#52baf3]'}`;
  };

  const getItemInputStyle = (index: number, field: keyof StoreItem) => {
    const fieldKey = `${index}.${field}`;
    const isChanged = changedFields.has(fieldKey);
    return `text-sm h-8 ${isChanged ? 'text-red-500 border-red-500' : 'text-[#52baf3] border-[#52baf3]'}`;
  };

  const getLabelStyle = () => 'block text-sm font-medium text-[#52baf3] mb-2';
  const getHeaderStyle = () => 'text-sm font-medium text-[#52baf3]';

  const getColumnHeaders = () => {
    switch (category) {
      case "lubes":
        return ["Lube Grade", "Lube Type", "Application", "ROB (Ltr)", "Consumed", "Received", "New ROB", "Comments"];
      case "chemicals":
        return ["Chem Code", "Chemical Name", "Application Area", "ROB (Ltr)", "Consumed", "Received", "New ROB", "Comments"];
      default:
        return ["Item Code", "Item Name", "Category", "ROB", "Consumed", "Received", "New ROB", "Comments"];
    }
  };

  return (
    <div className="w-[95%] max-w-7xl max-h-[90vh] overflow-auto bg-white rounded-lg shadow-lg">
      {/* Modal Header */}
      <div className="flex justify-between items-center p-4 border-b border-[#52baf3]">
        <h2 className="text-xl font-semibold text-[#52baf3]">
          Bulk Update {category.charAt(0).toUpperCase() + category.slice(1)} - Change Request
        </h2>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClose}
          className="h-8 w-8 p-0 text-[#52baf3] hover:bg-[#52baf3] hover:text-white"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Modal Body */}
      <div className="p-6">
        {/* Place Received and Date Fields */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded border border-[#52baf3]">
          <div>
            <label className={getLabelStyle()}>Place Received</label>
            <Input 
              placeholder="Enter place received" 
              value={placeReceived}
              onChange={(e) => handleInputChange('placeReceived', e.target.value)}
              className={getInputStyle('placeReceived')}
            />
          </div>
          <div>
            <label className={getLabelStyle()}>Date</label>
            <div className="relative">
              <Input 
                type="date" 
                value={dateReceived}
                onChange={(e) => handleInputChange('dateReceived', e.target.value)}
                className={`pr-10 ${getInputStyle('dateReceived')}`}
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#52baf3] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table Headers */}
        <div className="grid grid-cols-8 gap-3 bg-gray-50 p-3 rounded-t border border-[#52baf3]">
          {getColumnHeaders().map((header, index) => (
            <div key={index} className={getHeaderStyle()}>{header}</div>
          ))}
        </div>

        {/* Table Body */}
        <div className="border border-t-0 rounded-b max-h-[400px] overflow-y-auto border-[#52baf3]">
          {storeItems.map((item, index) => {
            const newRob = parseFloat(item.newRob) || 0;
            const minStock = 1; // Default minimum stock
            
            return (
              <div key={index} className="grid grid-cols-8 gap-3 p-3 border-b bg-white items-center">
                <div className="text-[#52baf3] text-sm">{item.itemCode || (index === 0 ? (category === "stores" ? "ST-TOOL-001" : category === "lubes" ? "ISO VG 100" : "CHM-ALK-001") : "")}</div>
                <div className="text-[#52baf3] text-sm">{item.itemName || (index === 0 ? (category === "stores" ? "Torque Wrench" : category === "lubes" ? "Compressor Oil" : "Alkaline Cleaner") : "")}</div>
                <div className="text-[#52baf3] text-sm">{item.storesCategory || (index === 0 ? (category === "stores" ? "Engine Stores" : category === "lubes" ? "Air Compressor #2" : "Engine Bilge Cleaning") : "")}</div>
                <div className="text-[#52baf3] text-sm">{item.rob || (index === 0 ? "2" : "")}</div>
                <div>
                  <Input 
                    type="number" 
                    min="0" 
                    className={getItemInputStyle(index, 'consumed')} 
                    placeholder="0"
                    value={item.consumed}
                    onChange={(e) => handleItemChange(index, 'consumed', e.target.value)}
                  />
                </div>
                <div>
                  <Input 
                    type="number" 
                    min="0" 
                    className={getItemInputStyle(index, 'received')} 
                    placeholder="0"
                    value={item.received}
                    onChange={(e) => handleItemChange(index, 'received', e.target.value)}
                  />
                </div>
                <div className={`text-sm font-medium ${newRob < minStock ? 'text-red-600' : 'text-[#52baf3]'}`}>
                  {item.newRob}
                </div>
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-[#52baf3] hover:bg-[#52baf3] hover:text-white"
                    onClick={() => openCommentDialog(index, item.itemName)}
                    data-testid={`button-item-comment-${index}`}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Footer */}
      <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
        <Button 
          variant="outline" 
          onClick={onClose}
          className="border-[#52baf3] text-[#52baf3] hover:bg-[#52baf3] hover:text-white"
        >
          Cancel
        </Button>
        <Button 
          className="bg-[#52baf3] hover:bg-[#40a8e0] text-white"
          onClick={handleSubmit}
        >
          Save Updates
        </Button>
      </div>

      <Dialog
        open={commentDialog.open}
        onOpenChange={(open) => {
          if (!open) closeCommentDialog();
        }}
      >
        <DialogContent className="max-w-lg" data-testid="dialog-item-comment">
          <DialogHeader>
            <DialogTitle>
              {commentDialog.itemName ? `Comment for ${commentDialog.itemName}` : 'Add Comment'}
            </DialogTitle>
            <DialogDescription>
              Add a comment for this item. Leave blank to clear an existing comment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="item-comment-textarea">Comment</Label>
            <Textarea
              id="item-comment-textarea"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Add a comment for this item"
              rows={5}
              maxLength={500}
              data-testid="textarea-item-comment"
            />
            <div className="flex items-center justify-end text-xs">
              <span className="text-gray-400" data-testid="text-item-comment-count">
                {commentDraft.length}/500
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeCommentDialog}
              data-testid="button-item-comment-cancel"
            >
              Cancel
            </Button>
            <Button
              className="bg-[#52baf3] hover:bg-[#40a8e0] text-white"
              onClick={() => {
                if (commentDialog.index !== null) {
                  handleItemChange(commentDialog.index, 'comments', commentDraft.trim());
                }
                closeCommentDialog();
              }}
              data-testid="button-item-comment-save"
            >
              Save Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoresChangeRequestForm;