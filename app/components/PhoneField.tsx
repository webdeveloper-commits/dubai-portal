"use client";
import PhoneInputLib from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

export default function PhoneField({ value, onChange, error }: Props) {
  const border = `1.5px solid ${error ? "#e53e3e" : "#e0e0e0"}`;
  return (
    <PhoneInputLib
      country="ae"
      value={value}
      onChange={onChange}
      enableSearch
      searchPlaceholder="Search country..."
      searchNotFound="No country found"
      preferredCountries={["ae", "sa", "qa", "kw", "bh", "om", "in", "pk", "gb", "us", "de", "fr", "ru", "cn", "au", "jo", "lb", "eg", "ma", "za"]}
      specialLabel=""
      containerStyle={{ width: "100%" }}
      inputStyle={{
        width: "100%",
        height: 44,
        border,
        borderRadius: 10,
        fontFamily: "Verdana, sans-serif",
        fontSize: 12,
        color: "#333",
        background: "#fafafa",
        paddingLeft: 54,
        outline: "none",
        boxSizing: "border-box",
      }}
      buttonStyle={{
        background: "#f4f6f9",
        border,
        borderRight: "none",
        borderRadius: "10px 0 0 10px",
      }}
      dropdownStyle={{
        borderRadius: 12,
        boxShadow: "0 12px 36px rgba(0,0,0,0.14)",
        border: "1.5px solid #e0e0e0",
        fontFamily: "Verdana, sans-serif",
        fontSize: 12,
        width: "min(300px, 90vw)",
      }}
      searchStyle={{
        fontFamily: "Verdana, sans-serif",
        fontSize: 12,
        border: "1.5px solid #e0e0e0",
        borderRadius: 8,
        padding: "6px 10px",
        width: "calc(100% - 20px)",
        outline: "none",
        margin: "6px 10px",
        boxSizing: "border-box",
      }}
    />
  );
}
