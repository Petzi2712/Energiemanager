using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Energy.Api.Migrations
{
    /// <inheritdoc />
    public partial class CustomerTechnicalRegister : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Devices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Number = table.Column<string>(type: "text", nullable: false),
                    Manufacturer = table.Column<string>(type: "text", nullable: false),
                    Model = table.Column<string>(type: "text", nullable: false),
                    MeterType = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Devices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Devices_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Points",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Number = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Medium = table.Column<string>(type: "text", nullable: false),
                    Unit = table.Column<string>(type: "text", nullable: false),
                    Quantity = table.Column<string>(type: "text", nullable: false),
                    Direction = table.Column<string>(type: "text", nullable: false),
                    ReadingIntervalDays = table.Column<int>(type: "integer", nullable: false),
                    MaxDailyConsumption = table.Column<decimal>(type: "numeric(24,6)", precision: 24, scale: 6, nullable: true),
                    Supplier = table.Column<string>(type: "text", nullable: false),
                    TariffReference = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Points", x => x.Id);
                    table.UniqueConstraint("AK_Points_CustomerId_Id", x => new { x.CustomerId, x.Id });
                    table.ForeignKey(
                        name: "FK_Points_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SiteScopes",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Restricted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SiteScopes", x => new { x.UserId, x.CustomerId });
                    table.ForeignKey(
                        name: "FK_SiteScopes_Memberships_CustomerId_UserId",
                        columns: x => new { x.CustomerId, x.UserId },
                        principalTable: "Memberships",
                        principalColumns: new[] { "CustomerId", "UserId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Installations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PointId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Factor = table.Column<decimal>(type: "numeric(24,6)", precision: 24, scale: 6, nullable: false),
                    Resolution = table.Column<decimal>(type: "numeric(24,6)", precision: 24, scale: 6, nullable: false),
                    Decimals = table.Column<int>(type: "integer", nullable: false),
                    RegisterLimit = table.Column<decimal>(type: "numeric(24,6)", precision: 24, scale: 6, nullable: true),
                    ValidFrom = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ValidTo = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Installations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Installations_Devices_DeviceId",
                        column: x => x.DeviceId,
                        principalTable: "Devices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Installations_Points_PointId",
                        column: x => x.PointId,
                        principalTable: "Points",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Nodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentId = table.Column<Guid>(type: "uuid", nullable: true),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    Number = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Address = table.Column<string>(type: "text", nullable: false),
                    Contact = table.Column<string>(type: "text", nullable: false),
                    Usage = table.Column<string>(type: "text", nullable: false),
                    OperatingHours = table.Column<string>(type: "text", nullable: false),
                    WorkingDays = table.Column<string>(type: "text", nullable: false),
                    ShiftModel = table.Column<string>(type: "text", nullable: false),
                    ProductionHours = table.Column<string>(type: "text", nullable: false),
                    UsableArea = table.Column<decimal>(type: "numeric(24,6)", precision: 24, scale: 6, nullable: true),
                    HeatedArea = table.Column<decimal>(type: "numeric(24,6)", precision: 24, scale: 6, nullable: true),
                    Year = table.Column<int>(type: "integer", nullable: true),
                    Heating = table.Column<string>(type: "text", nullable: false),
                    Cooling = table.Column<string>(type: "text", nullable: false),
                    Lighting = table.Column<string>(type: "text", nullable: false),
                    EnergySources = table.Column<string>(type: "text", nullable: false),
                    SupplySystems = table.Column<string>(type: "text", nullable: false),
                    TimeZone = table.Column<string>(type: "text", nullable: false),
                    AssetType = table.Column<string>(type: "text", nullable: false),
                    Manufacturer = table.Column<string>(type: "text", nullable: false),
                    Model = table.Column<string>(type: "text", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    RatedPowerW = table.Column<decimal>(type: "numeric(24,6)", precision: 24, scale: 6, nullable: false),
                    SystemPowerW = table.Column<decimal>(type: "numeric(24,6)", precision: 24, scale: 6, nullable: true),
                    AnnualHours = table.Column<decimal>(type: "numeric(24,6)", precision: 24, scale: 6, nullable: false),
                    OperatingDays = table.Column<decimal>(type: "numeric(24,6)", precision: 24, scale: 6, nullable: false),
                    LoadFactor = table.Column<decimal>(type: "numeric(24,6)", precision: 24, scale: 6, nullable: false),
                    MeasuringPointId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    CustomFields = table.Column<string>(type: "jsonb", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Nodes", x => x.Id);
                    table.UniqueConstraint("AK_Nodes_CustomerId_Id", x => new { x.CustomerId, x.Id });
                    table.ForeignKey(
                        name: "FK_Nodes_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Nodes_Nodes_CustomerId_ParentId",
                        columns: x => new { x.CustomerId, x.ParentId },
                        principalTable: "Nodes",
                        principalColumns: new[] { "CustomerId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Nodes_Points_CustomerId_MeasuringPointId",
                        columns: x => new { x.CustomerId, x.MeasuringPointId },
                        principalTable: "Points",
                        principalColumns: new[] { "CustomerId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Readings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PointId = table.Column<Guid>(type: "uuid", nullable: false),
                    InstallationId = table.Column<Guid>(type: "uuid", nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(24,6)", precision: 24, scale: 6, nullable: false),
                    IsRollover = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Event = table.Column<string>(type: "text", nullable: false),
                    Comment = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Readings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Readings_Installations_InstallationId",
                        column: x => x.InstallationId,
                        principalTable: "Installations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Readings_Points_PointId",
                        column: x => x.PointId,
                        principalTable: "Points",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Readings_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Replacements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PointId = table.Column<Guid>(type: "uuid", nullable: false),
                    OldInstallationId = table.Column<Guid>(type: "uuid", nullable: false),
                    NewInstallationId = table.Column<Guid>(type: "uuid", nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Replacements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Replacements_Installations_NewInstallationId",
                        column: x => x.NewInstallationId,
                        principalTable: "Installations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Replacements_Installations_OldInstallationId",
                        column: x => x.OldInstallationId,
                        principalTable: "Installations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Replacements_Points_PointId",
                        column: x => x.PointId,
                        principalTable: "Points",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Assignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    PointId = table.Column<Guid>(type: "uuid", nullable: false),
                    SiteId = table.Column<Guid>(type: "uuid", nullable: false),
                    NodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentPointId = table.Column<Guid>(type: "uuid", nullable: true),
                    ValidFrom = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ValidTo = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Assignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Assignments_Nodes_CustomerId_NodeId",
                        columns: x => new { x.CustomerId, x.NodeId },
                        principalTable: "Nodes",
                        principalColumns: new[] { "CustomerId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Assignments_Nodes_CustomerId_SiteId",
                        columns: x => new { x.CustomerId, x.SiteId },
                        principalTable: "Nodes",
                        principalColumns: new[] { "CustomerId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Assignments_Points_CustomerId_ParentPointId",
                        columns: x => new { x.CustomerId, x.ParentPointId },
                        principalTable: "Points",
                        principalColumns: new[] { "CustomerId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Assignments_Points_CustomerId_PointId",
                        columns: x => new { x.CustomerId, x.PointId },
                        principalTable: "Points",
                        principalColumns: new[] { "CustomerId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SitePermissions",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SiteId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SitePermissions", x => new { x.UserId, x.SiteId });
                    table.ForeignKey(
                        name: "FK_SitePermissions_Nodes_SiteId",
                        column: x => x.SiteId,
                        principalTable: "Nodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SitePermissions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Documents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    NodeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReadingId = table.Column<Guid>(type: "uuid", nullable: true),
                    BlobName = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    ContentType = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Documents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Documents_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Documents_Nodes_CustomerId_NodeId",
                        columns: x => new { x.CustomerId, x.NodeId },
                        principalTable: "Nodes",
                        principalColumns: new[] { "CustomerId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Documents_Readings_ReadingId",
                        column: x => x.ReadingId,
                        principalTable: "Readings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ReadingRevisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReadingId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Before = table.Column<string>(type: "text", nullable: false),
                    After = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReadingRevisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReadingRevisions_Readings_ReadingId",
                        column: x => x.ReadingId,
                        principalTable: "Readings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReadingRevisions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_CustomerId_NodeId",
                table: "Assignments",
                columns: new[] { "CustomerId", "NodeId" });

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_CustomerId_ParentPointId",
                table: "Assignments",
                columns: new[] { "CustomerId", "ParentPointId" });

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_CustomerId_PointId",
                table: "Assignments",
                columns: new[] { "CustomerId", "PointId" });

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_CustomerId_SiteId",
                table: "Assignments",
                columns: new[] { "CustomerId", "SiteId" });

            migrationBuilder.CreateIndex(
                name: "IX_Assignments_PointId",
                table: "Assignments",
                column: "PointId",
                unique: true,
                filter: "\"ValidTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Devices_CustomerId_Number",
                table: "Devices",
                columns: new[] { "CustomerId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Documents_CustomerId_NodeId",
                table: "Documents",
                columns: new[] { "CustomerId", "NodeId" });

            migrationBuilder.CreateIndex(
                name: "IX_Documents_ReadingId",
                table: "Documents",
                column: "ReadingId");

            migrationBuilder.CreateIndex(
                name: "IX_Installations_DeviceId",
                table: "Installations",
                column: "DeviceId",
                unique: true,
                filter: "\"ValidTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Installations_PointId",
                table: "Installations",
                column: "PointId",
                unique: true,
                filter: "\"ValidTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Nodes_CustomerId_MeasuringPointId",
                table: "Nodes",
                columns: new[] { "CustomerId", "MeasuringPointId" });

            migrationBuilder.CreateIndex(
                name: "IX_Nodes_CustomerId_Number",
                table: "Nodes",
                columns: new[] { "CustomerId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Nodes_CustomerId_ParentId",
                table: "Nodes",
                columns: new[] { "CustomerId", "ParentId" });

            migrationBuilder.CreateIndex(
                name: "IX_Points_CustomerId_Number",
                table: "Points",
                columns: new[] { "CustomerId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ReadingRevisions_ReadingId",
                table: "ReadingRevisions",
                column: "ReadingId");

            migrationBuilder.CreateIndex(
                name: "IX_ReadingRevisions_UserId",
                table: "ReadingRevisions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Readings_CreatedBy",
                table: "Readings",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Readings_InstallationId_At",
                table: "Readings",
                columns: new[] { "InstallationId", "At" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Readings_PointId_At",
                table: "Readings",
                columns: new[] { "PointId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_Replacements_NewInstallationId",
                table: "Replacements",
                column: "NewInstallationId");

            migrationBuilder.CreateIndex(
                name: "IX_Replacements_OldInstallationId",
                table: "Replacements",
                column: "OldInstallationId");

            migrationBuilder.CreateIndex(
                name: "IX_Replacements_PointId",
                table: "Replacements",
                column: "PointId");

            migrationBuilder.CreateIndex(
                name: "IX_SitePermissions_SiteId",
                table: "SitePermissions",
                column: "SiteId");

            migrationBuilder.CreateIndex(
                name: "IX_SiteScopes_CustomerId_UserId",
                table: "SiteScopes",
                columns: new[] { "CustomerId", "UserId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Assignments");

            migrationBuilder.DropTable(
                name: "Documents");

            migrationBuilder.DropTable(
                name: "ReadingRevisions");

            migrationBuilder.DropTable(
                name: "Replacements");

            migrationBuilder.DropTable(
                name: "SitePermissions");

            migrationBuilder.DropTable(
                name: "SiteScopes");

            migrationBuilder.DropTable(
                name: "Readings");

            migrationBuilder.DropTable(
                name: "Nodes");

            migrationBuilder.DropTable(
                name: "Installations");

            migrationBuilder.DropTable(
                name: "Devices");

            migrationBuilder.DropTable(
                name: "Points");
        }
    }
}
