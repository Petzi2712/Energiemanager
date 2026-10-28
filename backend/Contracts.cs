using System.ComponentModel.DataAnnotations;

namespace Energy;

public record LoginInput([property: Required, EmailAddress, MaxLength(254)] string Email, [property: Required, MaxLength(200)] string Password);
public record PasswordInput([property: Required, MaxLength(200)] string CurrentPassword, [property: Required, MaxLength(200)] string NewPassword);
public record ForgotInput([property: Required, EmailAddress, MaxLength(254)] string Email);
public record ResetInput([property: Required, EmailAddress, MaxLength(254)] string Email, [property: Required, MaxLength(100)] string Token, [property: Required, MaxLength(200)] string NewPassword);
public record CustomerInput(
    [property: Required, MaxLength(40)] string Number,
    [property: Required, MaxLength(200)] string Name,
    [property: MaxLength(80)] string LegalForm = "",
    [property: MaxLength(500)] string Address = "",
    [property: MaxLength(160)] string Contact = "",
    [property: MaxLength(254)] string Email = "",
    [property: MaxLength(80)] string Phone = "",
    [property: MaxLength(80)] string VatId = "",
    [property: MaxLength(500)] string BillingAddress = "",
    [property: MaxLength(4000)] string Notes = "",
    DateOnly? ContractStart = null,
    bool IsActive = true,
    bool AllowUserManagement = false,
    int Version = 1);
public record UserInput(
    [property: Required, EmailAddress, MaxLength(254)] string Email,
    [property: Required, MaxLength(160)] string Name,
    [property: Required] string Role,
    Guid[] CustomerIds,
    bool IsActive = true);
public record UserUpdateInput(
    [property: Required, MaxLength(160)] string Name,
    [property: Required] string Role,
    Guid[] CustomerIds,
    bool IsActive,
    [property: Required] string SessionVersion);
