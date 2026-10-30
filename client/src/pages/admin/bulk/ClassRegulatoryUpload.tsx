import { useQuery } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import UniformBulkUpload from "@/components/admin/UniformBulkUpload";
import { useAuth } from "@/contexts/AuthContext";
import { sectionHRequest } from "@/lib/sectionHRequest";
import { queryClient } from "@/lib/queryClient";
import { getClassRegulatoryFieldMappings } from "@shared/bulkImportTemplateFields";

interface ClassRegulatoryUploadProps {
  vesselId: string;
}

export default function ClassRegulatoryUpload({ vesselId }: ClassRegulatoryUploadProps) {
  const { sectionHUser } = useAuth();
  const masters = useQuery({
    queryKey: ["/technical/api/bulk/class-regulatory/reference", vesselId],
    enabled: !!sectionHUser && !!vesselId,
    queryFn: async () => {
      const [societies, surveyTypes] = await Promise.all([
        sectionHRequest(sectionHUser, "GET", "/technical/api/fleet/master-lists?listType=classificationSociety").then(r => r.json()),
        sectionHRequest(sectionHUser, "GET", "/technical/api/fleet/master-lists?listType=surveyType").then(r => r.json()),
      ]);
      return { societies, surveyTypes };
    },
  });

  const refreshSectionH = () => {
    queryClient.invalidateQueries({ queryKey: ["/technical/api/component-class-regulatory"] });
  };

  return (
    <UniformBulkUpload
      title="Classification & Regulatory Data"
      description="Import vessel-specific Section H records. Supporting attachments are not part of this workbook."
      icon={BadgeCheck}
      templateType="class-regulatory"
      templateFileName="class_regulatory_template.xlsx"
      fieldMappings={getClassRegulatoryFieldMappings()}
      vesselId={vesselId}
      previewColumns={["Component Code", "Certificate Number", "Classification Society", "Survey Type", "Vessel Code", "Action"]}
      onRefreshData={refreshSectionH}
      classRegulatoryReferences={masters.data}
      referenceLoading={masters.isLoading}
      referenceError={masters.isError}
      onRetryReferences={() => void masters.refetch()}
    />
  );
}
