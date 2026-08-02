import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { cn } from "@/lib/utils";

const Form = FormProvider;

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return <Controller {...props} />;
}

const FormItem = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-2", className)} {...props} />
  ),
);
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-sm font-medium", className)} {...props} />
  ),
);
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ ...props }, ref) => <div ref={ref} {...props} />,
);
FormControl.displayName = "FormControl";

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { getFieldState } = useFormContext();
  const fieldState = getFieldState(props.id ?? "");

  if (!fieldState.error?.message) return null;

  return (
    <p className={cn("text-sm text-destructive", className)} {...props}>
      {String(fieldState.error.message)}
    </p>
  );
}

export { Form, FormControl, FormField, FormItem, FormLabel, FormMessage };
